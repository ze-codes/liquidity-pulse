const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Explicitly set workspace root to silence lockfile warning
  outputFileTracingRoot: path.join(__dirname, "../"),

  // Rewrite API calls to Python backend in development
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
        }/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
