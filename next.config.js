/** @type {import('next').NextConfig} */
const nextConfig = {
  // Google Drive 配下などで inotify / FSEvents の上限に当たり、app/page が認識されず / が 404 になるのを避ける
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
};
module.exports = nextConfig;
