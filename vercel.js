// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/public/(.*)",
      "dest": "/public/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/index.js",
      "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
