import dotenv from "dotenv";
import { OpenAI } from "openai";
import {
  RDSDataClient,
  ExecuteStatementCommand,
} from "@aws-sdk/client-rds-data";

import feelingList from "./feelingList.mjs";

dotenv.config();

const REGION = process.env.REGION;
const DB_CLUSTER_ARN = process.env.DB_CLUSTER_ARN;
const SECRET_ARN = process.env.SECRET_ARN;
const DB_NAME = process.env.DB_NAME;
const TABLE_NAME = process.env.TABLE_NAME;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const rds = new RDSDataClient({
  region: REGION,
});

(async () => {
  try {
    if (!REGION || !DB_CLUSTER_ARN || !SECRET_ARN || !DB_NAME || !TABLE_NAME) {
      throw new Error("未設定の環境変数があります");
    }

    // a. 自分でEmbeddingを作成する場合
    // const queryEmbedding = await getQueryVector(
    //   "心がふわりと弾むような、ときめく恋の物語に触れたい"
    // );

    // b. 作成済みのEmbeddingを使う場合
    const queryEmbedding = feelingList[0].embedding;

    // number[] -> '[..., ...]' 形式の文字列に変換
    const queryEmbeddingString = `[${queryEmbedding.join(",")}]`;

    const sql = `
      SELECT
        id,
        title,
        embedding <=> :embedding::vector AS distance
      FROM ${TABLE_NAME}
      ORDER BY embedding <=> :embedding::vector
      LIMIT 3;
    `;

    // コマンド作成 for RDS Data API
    const cmd = new ExecuteStatementCommand({
      resourceArn: DB_CLUSTER_ARN,
      secretArn: SECRET_ARN,
      database: DB_NAME,
      sql,
      parameters: [
        {
          name: "embedding",
          value: { stringValue: queryEmbeddingString },
        },
      ],
      includeResultMetadata: true, // カラム名を取得
    });

    // コマンド実行
    const res = await rds.send(cmd);

    // カラム名の一覧取得。[id, title, author, ...]
    const columnList = res.columnMetadata?.map((c) => c.label || c.name) ?? [];

    for (const record of res.records ?? []) {
      // １行ごと
      const row = {};
      // １列ずつ値を取得
      record.forEach((col, idx) => {
        // カラム名
        const colName = columnList[idx];
        if (!colName) return;

        // title: { stringValue: "abcd" } のような形式でデータが格納されてる
        const value = col.stringValue ?? col.doubleValue ?? null;

        row[colName] = value;
      });

      console.log("ID:", row.id);
      console.log("タイトル:", row.title);
      console.log("距離:", Number(row.distance).toFixed(4));
      console.log("----");
    }
  } catch (err) {
    console.error(err);
    return;
  }
})();

async function getQueryVector(queryText) {
  const embRes = await openai.embeddings.create({
    model: "text-embedding-3-large",
    input: queryText,
  });
  return embRes.data[0].embedding;
}
