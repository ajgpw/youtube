## 前提

- Node.js 20 以上
- npm 11 以上
- Cloudflare Workers へ展開する場合は Wrangler が使えること
- Google Apps Script 版を更新する場合は、GAS の編集権限があること

## 1. 依存関係をインストールする

初回、または `package-lock.json` が更新された後に実行します。

```bash
npm install
```

ルートの `postinstall` により、`client/` 側の依存関係インストールとビルドも実行されます。

## 2. ローカルで開発確認する

フロントエンドだけを Vite で確認する場合:

```bash
npm run dev
```