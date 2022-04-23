.DEFAULT_GOAL := build

build: script.ts
	tsc script.ts --outFile js/script.js
