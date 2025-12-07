import { RDSDataClient, ExecuteStatementCommand } from "@aws-sdk/client-rds-data";
import { promises as fs } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const REGION = process.env.REGION;
const DB_CLUSTER_ARN = process.env.DB_CLUSTER_ARN;
const SECRET_ARN = process.env.SECRET_ARN;
const DB_NAME = process.env.DB_NAME;
const DATA_DIR = path.resolve("data");
const EXPECTED_DIM = 3072;

const client = new RDSDataClient({ region: REGION });

(async () => {

  try {
    if (!REGION || !DB_CLUSTER_ARN || !SECRET_ARN || !DB_NAME) {
      throw new Error("未設定の環境変数があります");
    }

    // 各記事JSONを取得
    const fileList = await fs.readdir(DATA_DIR);
    const jsonList = fileList.filter((f) => f.endsWith(".json"));

    // 各記事JSON => 配列
    const articleList = [];

    for (const fileName of jsonList) {
      const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf-8");
      const articleData = JSON.parse(raw);
      articleList.push( { ...articleData, fileName });
    }

    for (const article of articleList) {
      // embeddingがあるか、次元数が正しいか
      if (!Array.isArray(article.embedding) || article.embedding.length !== EXPECTED_DIM) {
        console.warn(`⚠ 無効なembedding: ${article.fileName}`);
        continue;
      }
      // embedding: number[] -> '[..., ...]' 形式の文字列に変換
      const embedding = `[${article.embedding.join(",")}]`;

      // コマンド作成 for RDS Data API
      const cmd = new ExecuteStatementCommand({
        resourceArn: DB_CLUSTER_ARN,
        secretArn: SECRET_ARN,
        database: DB_NAME,
        sql: `
          INSERT INTO articles (
            id,
            author,
            title,
            summary,
            url,
            embedding
          ) VALUES (
            :id,
            :author,
            :title,
            :summary,
            :url,
            :embedding::vector
          )
          ON CONFLICT (id) DO UPDATE
          SET
            author    = EXCLUDED.author,
            title     = EXCLUDED.title,
            summary   = EXCLUDED.summary,
            url       = EXCLUDED.url,
            embedding = EXCLUDED.embedding;
        `,
        parameters: [
          // idをTEXT型としたので明示的に文字列へ変換
          { name: "id", value: { stringValue: String(article.index) } },
          { name: "author",  value: { stringValue: article.author ?? "" } },
          { name: "title",   value: { stringValue: article.title ?? "" } },
          { name: "summary", value: { stringValue: article.summary ?? "" } },
          { name: "url", value: { stringValue: article.url ?? "" } },
          { name: "embedding", value: { stringValue: embedding } },
        ],
      });

      // コマンド実行
      await client.send(cmd);
      console.log(`✔ inserted/updated id=${article.index} (file: ${article.fileName})`);
    } // for

    console.log(`Done. inserted ${articleList.length} docs.`);

  } catch (err) {
    console.error(err);
    return;
  }

})();
