import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectDir = path.dirname(fileURLToPath(import.meta.url));

function getHtmlInputs() {
  const inputs: Record<string, string> = {
    main: path.resolve(projectDir, 'index.html'),
  };
  const pagesDir = path.resolve(projectDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    for (const file of fs.readdirSync(pagesDir)) {
      if (file.endsWith('.html')) {
        const name = file.replace(/\.html$/, '');
        inputs[`page_${name}`] = path.resolve(pagesDir, file);
      }
    }
  }
  return inputs;
}

export default defineConfig(() => {
  return {
    appType: 'mpa',
    plugins: [
      {
        name: 'sportlink-mpa-fallback',
        transformIndexHtml(html) {
          if (html.includes('href="/favicon.ico"')) return html;
          return html.replace(/<head>/i, `<head>
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48.png" />
    <link rel="icon" type="image/png" sizes="64x64" href="/favicon-64.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512.png" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-precomposed.png" />`);
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const urlPath = (req.url || '/').split('?')[0];
            const sendNotFound = async () => {
              try {
                const pagePath = path.resolve(projectDir, 'pages/404.html');
                const pageHtml = await fs.promises.readFile(pagePath, 'utf8');
                const html = await server.transformIndexHtml(req.url || '/pages/404.html', pageHtml);
                res.statusCode = 404;
                res.setHeader('Content-Type', 'text/html; charset=utf-8');
                res.end(html);
              } catch (error) {
                next(error);
              }
            };
            if (
              urlPath !== '/' &&
              !urlPath.startsWith('/@') &&
              !urlPath.startsWith('/node_modules') &&
              !urlPath.startsWith('/css/') &&
              !urlPath.startsWith('/js/') &&
              !urlPath.startsWith('/src/') &&
              !urlPath.startsWith('/assets/') &&
              !urlPath.startsWith('/pages/') &&
              !path.extname(urlPath)
            ) {
              const candidate = path.resolve(projectDir, 'pages', `${urlPath.replace(/^\/+/, '')}.html`);
              if (fs.existsSync(candidate)) {
                req.url = `/pages/${urlPath.replace(/^\/+/, '')}.html`;
              } else {
                await sendNotFound();
                return;
              }
            } else if (urlPath.startsWith('/pages/') && urlPath.endsWith('.html')) {
              const target = path.resolve(projectDir, urlPath.slice(1));
              if (!fs.existsSync(target)) {
                await sendNotFound();
                return;
              }
            }
            next();
          });
        },
      },
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(projectDir, 'dist');
          const srcAssets = path.resolve(projectDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input: getHtmlInputs(),
      },
    },
    resolve: {
      alias: {
        '@': projectDir,
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
