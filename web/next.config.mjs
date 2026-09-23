/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reads happen on the server so a page renders with the chain's numbers in
  // it; writes are signed in the browser. Nothing here holds a key.
  poweredByHeader: false,
};

export default nextConfig;
