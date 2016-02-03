all: clear
	node --harmony-destructuring parser.js

deps:
	npm install jsdom bluebird text-content

clear:
	clear; clear
