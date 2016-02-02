all:
	node --harmony-destructuring parser.js

deps:
	npm install jsdom bluebird
