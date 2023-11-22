import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import adapter from '@sveltejs/adapter-static';

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  kit: {
		adapter: adapter({
      pages: 'build',
			paths: {
        base: process.argv.includes('dev') ? '' : process.env.BASE_PATH
      },
		})
	}
}
