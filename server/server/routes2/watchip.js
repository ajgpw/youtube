// /routes2/watchip.js
import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

async function getServerGlobalIP() {
  const res = await fetch('https://api.ipify.org?format=text');
  if (!res.ok) throw new Error('IP取得失敗');
  const ip = await res.text();
  return ip.trim();
}

router.get('/', async (req, res) => {
  try {
    const ip = await getServerGlobalIP();
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>サーバーのグローバルIP</title>
        <style>
          body {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: #f9fafb;
            color: #222;
          }
          h1 {
            margin-bottom: 1rem;
            font-weight: 600;
            font-size: 1.5rem;
            text-align: center;
            color: #333;
          }
          #ip {
            font-size: 2rem;
            font-weight: 700;
            background: #c3c3c3;
            padding: 15px 30px;
            border-radius: 8px;
            user-select: all;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(99, 102, 241, 0.3);
            transition: background-color 0.3s ease;
          }
          #ip:hover {
            background: #c7d2fe;
          }
          button {
            margin-top: 1.2rem;
            padding: 10px 25px;
            font-size: 1rem;
            font-weight: 600;
            color: #333;
            background-color: #f5f5f5; /* 白に近いグレー */
            border: 1.5px solid #ccc;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: none;
            transition: background-color 0.3s ease, border-color 0.3s ease;
          }
          button:hover {
            background-color: #e0e0e0;
            border-color: #bdbdbd;
          }
          button:active {
            background-color: #d6d6d6;
            border-color: #9e9e9e;
          }
          .message {
            margin-top: 1rem;
            font-size: 1rem;
            color: #4caf50;
            height: 1.2rem;
            user-select: none;
          }
        </style>
      </head>
      <body>
        <h2>現在のIPアドレスは：</h2>
        <p id="ip" title="クリックで全選択">${ip}</p>
        <button id="copyBtn" aria-label="IPアドレスをコピー">コピー</button>
        <div class="message" id="msg"></div>

        <script>
          const ipElem = document.getElementById('ip');
          const copyBtn = document.getElementById('copyBtn');
          const msgElem = document.getElementById('msg');

          // クリックでテキスト全選択
          ipElem.addEventListener('click', () => {
            const range = document.createRange();
            range.selectNodeContents(ipElem);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          });

          copyBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(ipElem.textContent);
              msgElem.textContent = 'コピーしました。';
              setTimeout(() => { msgElem.textContent = ''; }, 2000);
            } catch {
              msgElem.textContent = 'コピーに失敗しました';
            }
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('サーバーのIP取得に失敗しました');
  }
});

export default router;
