module.exports = {
	globDirectory: './',
	globPatterns: [
		'**/*.{js,md,json,html,png,css,svg,ico,webp,jpg,jpeg,txt,woff,woff2,ttf,eot,wasm}'
	],
	globIgnores: [
		'**/node_modules/**',
		'.npm-cache/**',
		'apps/tu_vi_build/**'
	],
	swDest: 'sw.js',
	swSrc: 'sw-src.js'
};
