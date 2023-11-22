import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import adapter from '@sveltejs/adapter-static';

export default {
  // Consult https://svelte.dev/docs#compile-time-svelte-preprocess
  // for more information about preprocessors
  preprocess: vitePreprocess(),
  dev: true,
  kit: {
		adapter: adapter({
			paths: {
        base: process.env.NODE_ENV === "production" ? "/PrusaSlicerPressureAdvanceCalibration" : "",
      },
		})
	}
}
