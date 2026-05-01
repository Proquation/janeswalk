import adapter from '@sveltejs/adapter-static';

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
		paths: {
			base: isDev ? '' : '/janeswalkmap'
		},
		prerender: {
			entries: ['/', '*']
		}
	}
};

export default config;
