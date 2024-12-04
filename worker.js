const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>MINRL</title>
    <link rel="manifest" href="manifest.json" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />

    <style>
      body {
        background-color: #111827;
        color: #fff;
        margin: 0 auto;
        padding: 0 1.5rem;
      }

      nav {
        padding: 1.5rem 0;
      }

      .container {
        max-width: 600px;
        margin: 2rem auto;
        min-height: 80vh;
      }
    </style>
  </head>

  <body>
    <nav>
      <ul>
        <li>
          <strong><a href="/" style="text-decoration: none; color: white;">MINRL</a></strong>
        </li>
      </ul>
      <ul>
        <li><a href="/list" class="secondary">List 'em</a></li>
        <li><a href="/delete" class="secondary">Delete 'em</a></li>
      </ul>
    </nav>
    <main class="container">
      <form id="add-redirect-form">
        <h2>URL Shortner</h2>
        <label for="path">
          Path (optional)
          <input type="text" id="path" name="path" placeholder="custom-path" />
          <small>If no path is specified, a random path will be generated</small>
        </label>
        <label for="url">
          URL
          <input type="url" id="url" name="url" placeholder="https://example.com" required />
          <small id="urlFeedback" style="display: none; color: #ff4444">Please enter a valid URL</small>
        </label>
        <label for="secret">
          Secret Code
          <em data-tooltip="a secret password to delete your shorturl">?</em>
          <input type="password" id="secretCode" name="secretCode" placeholder="••••••••" required />
        </label>
        <button type="submit" class="contrast"><b> Create Short URL</b></button>
      </form>
      <dialog id="myModal">
        <article>
          <header>
            <button aria-label="Close" rel="prev"></button>
          </header>
          <p id="message"></p>
          <canvas id="qrcode"></canvas>
        </article>
      </dialog>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
    <script>
      const urlInput = document.getElementById("url");
      const urlFeedback = document.getElementById("urlFeedback");
      const form = document.getElementById("add-redirect-form");

      urlInput.addEventListener("input", function () {
        let isValid = false;
        try {
          new URL(this.value);
          isValid = true;
        } catch (e) {
          isValid = false;
        }
        this.setAttribute("aria-invalid", !isValid);
        urlFeedback.style.display = isValid ? "none" : "block";
      });

      async function loadRedirects() {
        table.innerHTML = "";
      }
      loadRedirects();
      const modal = document.getElementById("myModal");
      modal.addEventListener("close", () => modal.setAttribute("aria-hidden", "true"));
      modal.addEventListener("showModal", () => modal.setAttribute("aria-hidden", "false"));

      const closeButton = modal.querySelector("button[aria-label='Close']");
      const messageEl = document.getElementById("message");
      const canvas = document.getElementById("qrcode");

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const path = form.elements.path.value;
        const url = form.elements.url.value;
        const secretCode = form.elements.secretCode.value;

        const response = await fetch("/api/redirects", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ path, url, secretCode }),
        });
        const data = await response.json();
        messageEl.textContent = data.message + data.shortUrl;

        if (data.success) {
          QRCode.toCanvas(
            canvas,
            data.shortUrl,
            {
              color: {
                dark: "#FFFFFF",
                light: "#00000000",
              },
              width: 200,
              height: 200,
            },
            function (error) {
              if (error) console.error(error);
              console.log("QR Code successfully generated!");
            }
          );
          canvas.style.display = "block";
        } else {
          canvas.style.display = "none";
        }

        modal.showModal();
      });
      closeButton.addEventListener("click", () => {
        modal.close();
        form.reset();
      });
    </script>
    <footer class="container-fluid" style="text-align: center">
      <small>
        minrl = mini + url, a serverless URL shortener <br />
        made with ❤️ by Anas Khan.
        <a href="https://github.com/anxkhn/minirl" class="secondary" target="_blank" rel="noopener">Fork on GitHub</a>
      </small>
    </footer>
  </body>
</html>
`;
const SECRET_CODE = "code";

const manifest = JSON.stringify({
  name: "MINRL - URL Shortener",
  short_name: "MINRL",
  start_url: "/",
  display: "standalone",
  background_color: "#111827",
  theme_color: "#fff",
  icons: [
    {
      src: "/logo.png",
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: "/logo.png",
      sizes: "512x512",
      type: "image/png",
    },
  ],
});

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    const headers = {
      "X-Robots-Tag": "noindex, nofollow",
    };

    if (request.method === "GET" && pathname === "/") {
      return serveIndexPage(env);
    }

    if (request.method === "POST" && pathname === "/api/redirects") {
      return handleCreateRedirect(request, env);
    }

    if (request.method === "GET" && pathname === "/list") {
      return serveListPage(env);
    }

    if (request.method === "GET" && pathname === "/manifest.json") {
      return new Response(manifest, {
        headers: { "Content-Type": "application/manifest+json" },
      });
    }

    if (request.method === "GET" && pathname === "/delete") {
      return serveDeletePage(env);
    }

    if (request.method === "DELETE" && pathname === "/api/redirects") {
      return handleDeleteRedirect(request, env);
    }

    const key = pathname.split("/")[1];

    if (!key) {
      return new Response("Welcome to my redirector", { status: 200 });
    }

    if (key === "robots.txt") {
      return new Response("User-agent: *\nDisallow: /", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const dest = await env.kv.get(key);

    if (dest) {
      return new Response("Redirecting...", {
        status: 302,
        headers: { Location: dest },
      });
    }

    const notFoundHtmlContent = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Delete Shorten URLs</title>
    <link rel="manifest" href="manifest.json" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
    <style>
      body {
        background-color: #111827;
        color: #fff;
        margin: 0 auto;
        padding: 0 1.5rem;
      }

      nav {
        padding: 1.5rem 0;
      }

      .container {
        max-width: 600px;
        margin: 2rem auto;
        min-height: 80vh;
      }
    </style>
  </head>

  <body>
    <nav>
      <ul>
        <li>
          <strong><a href="/" style="text-decoration: none; color: white;">MINRL</a></strong>
        </li>
      </ul>
      <ul>
        <li><a href="/" class="secondary">Home</a></li>
        <li><a href="/list" class="secondary">List 'em</a></li>
      </ul>
    </nav>
    <main class="container">
      <h1>404</h1>
      <p>Oops! The page you're looking for doesn't exist.</p>
      <p>But don't worry, you can go back to the home page.</p>
      <a href="/">Go to Home</a>
    </main>
    <footer class="container-fluid" style="text-align: center">
      <small>
        minrl = mini + url, a serverless URL shortener <br />
        made with ❤️ by Anas Khan.
        <a href="https://github.com/anxkhn/minirl" class="secondary" target="_blank" rel="noopener">Fork on GitHub</a>
      </small>
    </footer>
  </body>
</html>
`;

    return new Response(notFoundHtmlContent, {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  },
};
async function serveIndexPage(env) {
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

async function handleCreateRedirect(request, env) {
  const formData = await request.formData();
  let path = formData.get("path");
  const url = formData.get("url");
  const secretCode = formData.get("secretCode");

  if (secretCode !== SECRET_CODE) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unauthorized",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!url) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid request",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!path) {
    const timestamp = Math.floor(Date.now() / 1000)
      .toString(36)
      .slice(-4);
    const randomString = generateRandomString(4);
    path = `${randomString}${timestamp}`;
  }

  const existingUrl = await env.kv.get(path);

  if (existingUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Ooh, already exists buddy",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await env.kv.put(path, url);
  const shortUrl = `${new URL(request.url).origin}/${path}`;

  return new Response(
    JSON.stringify({
      success: true,
      message: "Yaay, it is a success! Your short URL is ",
      shortUrl: shortUrl,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function generateRandomString(length) {
  const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

async function serveDeletePage(env) {
  return new Response(
    `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Delete Shortened URLs</title>
    <link rel="manifest" href="manifest.json" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
    <style>
      body {
        background-color: #111827;
        color: #fff;
        margin: 0 auto;
        padding: 0 1.5rem;
      }

      nav {
        padding: 1.5rem 0;
      }

      .container {
        max-width: 600px;
        margin: 2rem auto;
        min-height: 80vh;
      }
    </style>
  </head>

  <body>
    <nav>
      <ul>
        <li>
          <strong><a href="/" style="text-decoration: none; color: white;">MINRL</a></strong>
        </li>
      </ul>
      <ul>
        <li><a href="/" class="secondary">Home</a></li>
        <li><a href="/list" class="secondary">List 'em</a></li>
      </ul>
    </nav>

    <main class="container">
      <form id="delete-redirect-form">
        <h2>Delete Shortened URLs</h2>
        <label for="path">
          Path
          <input type="text" id="path" name="path" placeholder="custom-path" required />
        </label>

        <label for="secretCode">
          Secret Code
          <em data-tooltip="password that you used to create the redirect">?</em>
          <input type="password" id="secretCode" name="secretCode" placeholder="••••••••" required />
        </label>

        <button type="submit" class="contrast"><b>Delete Shortened URLs</b></button>
      </form>

      <dialog id="myModal">
        <article>
          <header>
            <button aria-label="Close" rel="prev"></button>
          </header>
          <p id="message"></p>
        </article>
      </dialog>
    </main>

    <script>
      const form = document.getElementById("delete-redirect-form");
      const modal = document.getElementById("myModal");
      const closeButton = modal.querySelector("button[aria-label='Close']");
      const messageEl = document.getElementById("message");

      modal.addEventListener("close", () => modal.setAttribute("aria-hidden", "true"));
      modal.addEventListener("showModal", () => modal.setAttribute("aria-hidden", "false"));

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const path = form.elements.path.value;
        const secretCode = form.elements.secretCode.value;

        const response = await fetch("/api/redirects", {
          method: "DELETE",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ path, secretCode }),
        });

        const data = await response.json();
        messageEl.textContent = data.message;
        modal.showModal();
      });

      closeButton.addEventListener("click", () => {
        modal.close();
        form.reset();
      });
    </script>
    <footer class="container-fluid" style="text-align: center">
      <small>
        minrl = mini + url, a serverless URL shortener <br />
        made with ❤️ by Anas Khan.
        <a href="https://github.com/anxkhn/minirl" class="secondary" target="_blank" rel="noopener">Fork on GitHub</a>
      </small>
    </footer>
  </body>
</html>
  `,
    { headers: { "Content-Type": "text/html" } }
  );
}

async function handleDeleteRedirect(request, env) {
  const formData = await request.formData();
  const path = formData.get("path");
  const secretCode = formData.get("secretCode");

  if (secretCode !== SECRET_CODE) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Unauthorized",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!path) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Invalid request",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const existingUrl = await env.kv.get(path);

  if (!existingUrl) {
    return new Response(
      JSON.stringify({
        success: false,
        message: "Redirect not found",
      }),
      {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  await env.kv.delete(path);
  return new Response(
    JSON.stringify({
      success: true,
      message: "Redirect deleted successfully",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

async function serveListPage(env) {
  const listResult = await env.kv.list();
  const keys = await Promise.all(
    listResult.keys.map(async ({ name, expiration, metadata }) => ({
      name,
      expiration: new Date(expiration * 1000).toLocaleString(),
      metadata,
      value: await env.kv.get(name),
    }))
  );

  const listHTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Shortened URLs</title>
    <link rel="manifest" href="manifest.json" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
    <style>
      body {
        background-color: #111827;
        color: #fff;
        margin: 0 auto;
        padding: 0 1.5rem;
      }

      nav {
        padding: 1.5rem 0;
      }

      .container {
        max-width: 600px;
        margin: 2rem auto;
        min-height: 80vh;
      }

      table {
        background-color: #111827;
        width: 100%;
        border-collapse: collapse;
        margin-top: 2rem;
      }

      th,
      td {
        padding: 1rem;
        text-align: left;
        word-wrap: break-word;
        background-color: #111827;
      }

      td {
        text-align: justify;
      }

      td.copy-key {
        cursor: pointer;
      }

      tr {
        height: auto;
      }
    </style>
  </head>

  <body>
    <nav>
      <ul>
        <li>
          <strong><a href="/" style="text-decoration: none; color: white;">MINRL</a></strong>
        </li>
      </ul>
      <ul>
        <li><a href="/" class="secondary">Home</a></li>
        <li><a href="/delete" class="secondary">Delete 'em</a></li>
      </ul>
    </nav>
    <main class="container">
      <h2>Shortened URLs</h2>
      <table id="shortened-urls-table">
        <thead>
          <tr>
            <th>Short URL</th>
            <th>Actual URL</th>
          </tr>
        </thead>
        <tbody>
        ${keys
          .map(
            ({ name, value, expiration, metadata }) => `
          <tr>
            <td class="copy-key" data-key="${name}">${name}</td>
            <td>${value}</td>
          </tr>
        `
          )
          .join("")}
        </tbody>
      </table>
    </main>
    <script>
      const keyCells = document.querySelectorAll(".copy-key");
      keyCells.forEach(cell => {
        cell.addEventListener("click", () => {
          const key = cell.getAttribute("data-key");
          const url = location.origin + "/" + key; 
          navigator.clipboard.writeText(url)
            .then(() => {
              alert(\`Copied: \${url}\`);
            })
            .catch((err) => {
              console.error("Failed to copy text: ", err);
            });
        });
      });
    </script>
    <footer class="container-fluid" style="text-align: center">
      <small>
        minrl = mini + url, a serverless URL shortener <br />
        made with ❤️ by Anas Khan.
        <a href="https://github.com/anxkhn/minirl" class="secondary" target="_blank" rel="noopener">Fork on GitHub</a>
      </small>
    </footer>
  </body>
</html>
`;
  return new Response(listHTML, { headers: { "Content-Type": "text/html" } });
}
