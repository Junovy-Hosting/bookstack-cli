# Simple helpers for building/installing the bookstack CLI

SHELL := /bin/sh
PREFIX ?= /usr/local
BINDIR ?= $(PREFIX)/bin
DIST := dist
BINARY := $(DIST)/bookstack

.PHONY: all build cli install uninstall clean

all: build cli

build:
	bun run build

cli: build
	bun build src/runner.ts --compile --outfile $(BINARY)

install: cli
	install -d $(BINDIR)
	install -m 0755 $(BINARY) $(BINDIR)/bookstack
	@echo "Installed to $(BINDIR)/bookstack"

uninstall:
	rm -f $(BINDIR)/bookstack
	@echo "Removed $(BINDIR)/bookstack (if it existed)"

clean:
	rm -rf $(DIST)
