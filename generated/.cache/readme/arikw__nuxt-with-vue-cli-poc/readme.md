# Sharing Components Between Nuxt 2.x And Vue CLI

This is a POC project that demonstrates how Vue components can be developed as stand-alone components using `Vue CLI` and how to use them in `Nuxt`.

Using the proposed method of development will:
* Help creating independent components
* Facilitate a standard way to create a live usage example ("usage files") for components

## Shared Components Library

The shared components should be located in `components/lib`, preferably in a dedicated folder accompanied with a usage file (`.usage.vue` file extension) to demonstrates how the component should be used.

See `components/lib/nested-list` as an example.

## Components Discovery Page

The `Vue CLI` project creates a route for each Vue component in `components/lib` and
exposes an index page [http://localhost:8080/](http://localhost:8080/) that links to all of the existing component usage files.

### Usage file

If a component has a usage file (e.g., `NestedList.vue` with `NestedList.usage.vue`), the usage file will be used when clicking on the component in the list

### Component dependencies

If a component in the library depends on other packages, `package.json` should be used to state these dependencies and a `file:` dependency should be added to the `package.json` of the `Nuxt` and `Vue CLI` projects to make the component dependencies be installed on `npm install`

`peerDependencies` should be used in `package.json` for dependencies that will probably exist in the project using the component.

See `components/lib/nested-list`, `package.json`, and `vue-cli/package.json`

#### Notice
`vue-cli/package.json` doesn't include the `vue` package as a dependency because otherwise `webpack` will inconsistently include `node_modules/vue` and `vue-cli/node_modules/vue` packages when building the `vue-cli` project.
To solve this issue, `vue` package is listed as a "peer dependency" in `vue-cli/package.json`

## Install and Run

### Setup

```bash
# install Nuxt dependencies
$ npm install

# install Vue CLI dependencies
$ cd vue-cli
$ npm install
```

### Run Nuxt

```bash
# serve with hot reload at localhost:3000
$ npm run dev
```

### Run Vue CLI

```bash
# serve with hot reload at localhost:8080
$ cd vue-cli
$ npm run serve
```

## POC Issues

* Relative paths must be used in shared components without `@` or `~` folder aliases
