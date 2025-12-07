# Auroraのセットアップ

- DBクラスター作成（DBをホストする環境・箱みたいなもの）
- DB作成
- テーブル作成

## DBクラスター作成

### エンジンのオプション

- エンジンのオプション:
  - Aurora(PostgreSQL Compatible)

### テンプレート

- テンプレート: 
  - 開発/テスト

### 設定

- DB クラスター識別子:
  - aozora-match
- 認証情報管理:
  - AWS Secrets Manager で管理 - 最も安全

### インスタンスの設定

- DB インスタンスクラス:
  - Serverless v2
- 最小キャパシティ（ACU）
  - 0.5
- 最大キャパシティ（ACU）
  - 128

### 接続

- Virtual Private Cloud (VPC)
  - 新しい VPC の作成
- DB サブネットグループ
  - 新しい DB サブネットグループの作成
- パブリックアクセス
  - なし
- VPC セキュリティグループ (ファイアウォール)
  - 新規作成
- 新しい VPC セキュリティグループ名
  - aozoara-match-sg
- アベイラビリティーゾーン
  - 指定なし
- RDS Data API
  - RDS Data API の有効化
  - ポスグレのドライバーのインストールをハンズオンでスキップしたかった

## DB作成

CloudShellで操作（※MacとWinの環境差異を吸収したいため）

### 環境変数の設定

- DBのREGION

```
export REGION=''
```

- DBクラスターのARN

```
export DB_CLUSTER_ARN='arn:aws:rds:ap-northeast-1:123456789012:cluster:example'
```

- Secret ManagerのARN（パスワード管理）

※ ARNに!が含まれてる点に注意

```
export SECRET_ARN='arn:aws:secretsmanager:ap-northeast-1:1234567890121:secret:rds!cluster-1234-5678-9012-3456'
```

- DB名

```
export DB_NAME='aozora-match'

```

- 設定できてるか確認したい

```
echo $DB_NAME
```

### 現在あるDBを確認

クラスターの中にあるDBを確認

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --sql "SELECT datname FROM pg_database;"
```

### DBを作成

DB名：`aozora-match`

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --sql "CREATE DATABASE $DB_NAME;"
```

### DBが作成されたか確認

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --sql "SELECT datname FROM pg_database;"
```

### ベクトル検索を有効化

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --sql "CREATE EXTENSION IF NOT EXISTS vector;"
```

## テーブル作成

### テーブル作成

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --sql "CREATE TABLE IF NOT EXISTS articles (
      id text PRIMARY KEY,
      title text,
      summary text,
      author text,
      url text,
      embedding vector(3072)
    );"
```

### テーブル一覧確認

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --sql "SELECT table_name
         FROM information_schema.tables
         WHERE table_schema='public';"
```

### カラム定義確認

embeddingがベクトル型になってるか確認

```
aws rds-data execute-statement \
  --region "$REGION" \
  --resource-arn "$DB_CLUSTER_ARN" \
  --secret-arn "$SECRET_ARN" \
  --database "$DB_NAME" \
  --sql "SELECT column_name, udt_name, data_type
         FROM information_schema.columns
         WHERE table_name='articles';"
```

# データ投入

- コードをDL

GitHubよりこのリポジトリをZIPでDLして解凍

- ライブラリをインストール

```
npm i
```

- 環境変数をセット

`.env`内の各変数をセット

- データを投入するプログラムを実行

```
node putData.mjs
```

# ベクトル検索を実行

- ベクトル検索を実行するプログラムを実行

```
node getData.mjs
```