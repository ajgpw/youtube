<h1>GAS Webアプリ デプロイ手順</h1>

<h2>コード</h2>
<pre><code>function doGet() {
  const text = UrlFetchApp.fetch(
    'https://raw.githubusercontent.com/ajgpw/youtube/refs/heads/main/index.html.txt'
  ).getContentText();
  return HtmlService.createHtmlOutput(text)
                    .setTitle('しあtube')
                    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function siatubeApiGet(pathAndQuery) {
  const value = String(pathAndQuery || '');
  const valid = value === '/api' || value.startsWith('/api/') || value.startsWith('/api?');
  if (!valid) throw new Error('Invalid API path');

  const directUrl = 'https://siatube.com' + value;
  const commonOptions = {
    headers: { Accept: 'application/json' },
    followRedirects: true,
    muteHttpExceptions: true
  };
  const response = directUrl.length &lt;= 1900
    ? UrlFetchApp.fetch(directUrl, commonOptions)
    : UrlFetchApp.fetch('https://siawaseok.duckdns.org/api/bridge', {
        ...commonOptions,
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({ pathAndQuery: value })
      });
  return {
    status: response.getResponseCode(),
    body: response.getContentText()
  };
}
</code></pre>

<h2>手順</h2>
<ol>
  <li>Google Apps Script のエディタを開き、既存のコードを上書きする形で上記のコードを貼り付ける
    <ul>
      <li>デプロイしても真っ白な画面になってしまう場合は<br>
      <code>https://raw.githubusercontent.com/ajgpw/youtube/refs/heads/main/index.html.txt</code><br>
      を<br>
      <code>https://raw.githubusercontent.com/ajgpw/ajgpw.github.io/refs/heads/main/%E3%81%97%E3%81%82tube/index.html</code><br>
      に置き換えて再度デプロイしてください</li>
    </ul>
  </li>
  <li>右上の <strong>「デプロイ」</strong> をクリック</li>
  <li><strong>「新しいデプロイ」</strong> を選択</li>
  <li>種類から <strong>「ウェブアプリ」</strong> を選択</li>
  <li>必要に応じて説明を入力し、アクセス権限を設定</li>
  <li><strong>「デプロイ」</strong> をクリック</li>
  <li>認証画面が出た場合は、指示に従って認証を完了</li>
  <li>デプロイ完了後に表示されるURLにアクセスすると、GitHub 上の <code>index.html.txt</code> のHTMLが実行されます</li>
  <li>既存デプロイの更新時も、<code>siatubeApiGet</code> を含む上記コード全体へ置き換えて再デプロイしてください</li>
  <li>長い continuation token 用の中継を有効にするため、GAS 版より先に、このリポジトリの最新 <code>server/index.js</code> を <code>siawaseok.duckdns.org</code> へデプロイしてください</li>
</ol>

<h2>注意点</h2>
<ul>
  <li>環境によっては JS や CSS を配信している CDN がブロックされてページが真っ白になる場合があります。
      その場合は<br>
      <code>https://raw.githubusercontent.com/ajgpw/ajgpw.github.io/refs/heads/main/%E3%81%97%E3%81%82tube/index.html</code>
      を使用してください。</li>
  <li>ページを開いたときに”/”へ行きますがそれが嫌な場合<a href="https://github.com/ajgpw/youtube/blob/edc7059a7f4bd557fe4c7d393b8ecce22aaabb41/client/src/components/HeaderSearch.vue#L156">https://github.com/ajgpw/youtube/blob/edc7059a7f4bd557fe4c7d393b8ecce22aaabb41/client/src/components/HeaderSearch.vue#L156</a><br>ここを編集してください</li>
  <li>CSS と JS が大量に HTML 内に含まれているため、端末によってはページが重くなる場合があります（ブラウザで実行する分には影響はありません）。</li>
</ul>

<h2>連絡先・コミュニティ</h2>
<ul style="list-style: none; padding: 0;">
  <li>
    <img src="https://www.google.com/a/cpanel/images/favicon.ico" alt="メール" width="16" height="16" style="vertical-align: middle; margin-right: 4px;">
    siatube.web@gmail.com
  </li>
  <li>
    <img src="https://www.line.me/static/img/apple-touch-icon-57x57.png" alt="LINE" width="16" height="16" style="vertical-align: middle; margin-right: 4px;">
    <a href="https://line.me/ti/g2/PT62G9W_N5WOkD7VECW3tftJlCn2KTJIVt6k7g" target="_blank">LINEオープンチャット</a>
  </li>
  <li>
    <img src="https://assets.chatwork.com/images/favicon/favicon00.ico" alt="Chatwork" width="16" height="16" style="vertical-align: middle; margin-right: 4px;">
    <a href="https://www.chatwork.com/g/siatube" target="_blank">Chatwork</a>
  </li>
</ul>
