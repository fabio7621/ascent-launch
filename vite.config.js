import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// base: './' 讓 build 出來的檔案可以直接放到 GitHub Pages 之類的子路徑
export default defineConfig({
  plugins: [vue()],
  base: './',
  build: {
    // three.js 單獨拆成一個 chunk，方便瀏覽器快取
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
