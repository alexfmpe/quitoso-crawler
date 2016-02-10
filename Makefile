LIBS = jsdom bluebird text-content request-promise

all: clear
	time node --harmony-destructuring parser.js

deps:
	npm install $(LIBS)

clear:
	clear; clear
