> Docs aren't completed and may contain outdated data, local-package-manager
> is still in testing phase. Until an official version is released to npm, install and use at your own risk. Bugs and errors may occur that may hinder your development process.

> Local Package Manager is currently only used in-house, updates may not be frequent as yet and possible updates may not be released incrementally.

<div  align="center">

<h3  align="center">Local Package Manager</h3>

<p  align="center">

For locally developing/testing/publishing your npm packages.

</p>

</div>

## About The Project

When testing your npm packages, you may try to use the `link` command of package managers, e.g `yarn link` `npm link`, However `link` may provided unwanted results like;

- Files in `.gitignore`/`.npmignore`/`package.json->files` aren't respected. This is because link only creates a symbolic link between package directory and the working directory.

- Dependencies/Dependencies of dependencies not being installed.

a current solution [yalc](https://github.com/wclr/yalc) aims to fix these problems, but I have personally experienced some unwanted behavior with it, hence I created `lpm` to solve these problems and implement features that I expected from `yalc`

What lpm provides:

- `lpm` provides a way to have a local-registry on your machine, similarly to `npm publish`, `lpm publish` will pack your package, run any related `scripts` and upload it locally instead of a live registry. You can then `install`/`import` these published locally published packages across your device.

- A way to quickly go from a locally published package to live.

- Similar syntax to existing package managers

## Getting Started

### Prerequisites

Make sure you have `lpm` installed globally.

```sh
npm  install  mekstuff@lpm  -g
```

> **Warning**
> lpm is not yet available on npm, instead clone repo, compile and locally install.

## Usage

### Publishing

To publish a package run `lpm publish` in the directory of the package.

> use the `no-scripts` flag to publish without running scripts.

> use the `requires-import` flag to signify the package can only be installed through importing, learn about [importing]() here.

Your package will be published at `~/.local-package-mananger/packages`

### Installing

There's `two` ways to install packages to your project, `adding` and `importing`

#### Adding packages

You can add a package by either using the cli or adding it to your `package.json` file.

Just like `yarn`/`npm`, `lpm` has `dependencies, devDependencies, optionalDependencies, peerDependencies`. But unlike the traditional package manager where you specify at "root" level of your package.json, `lpm` packages are specified under a field called `local`.

```json
"name": "@mekstuff/lpm",
"version": "1.0.0",
"local": {
	"dependencies": {
		"@fake/dependency": "^1.4.5"
	}
}
```

> You could also get the same result by using the cli:
> `lpm add @fake/dependency@1.4.5`

#### Importing packages

An imported package is a package that will be pulled into the working directory. Unlike adding, where the installed package points to the published copy of the package, imported packages are pointed to the local directory store, this means that your package will have its own copy of the published package.

```json
"name": "@mekstuff/lpm",
"version": "1.0.0",
"local": {
	"dependencies": {
		"@fake/dependency": ["^1.4.5", "import"]
	}
}
```

> You could also get the same result by using the cli:
> `lpm import @fake/dependency@1.4.5` ||
> `lpm add @fake/dependency@1.4.5 --import`

You may use imported packages when the said package is not published to a live registry, and you plan release the current package to the public. Since said package will not be accessible to anyone, import makes a copy of it which will be apart of the current package.

e.g.

> `Package A `is published locally, `Package B` uses `Package A` but you want to publish `Package B` to a remote registry (npm registry). `Package A` will be imported and 'become' apart of the actual `Package B` bundle, so even without `Package A`being published, people who install `Package B` will have access to `Package A` through its imported copy.

##### Traversing imports

Traversing imports is a way to make sure that every dependent package is also imported, in the example above, Imagine if `Package A` also had a unpublished dependency of `Package C`, to make sure `Package C` is also imported for out `Package B` package, use the `--traverse-imports` flag.

### Uninstalling package

`lpm remove example` removes the package, no matter how it was installed.

### Upgrading packages

```sh
lpm upgrade [packageName]
```

Creates an interactive prompt for upgrading currently installed packages or the specified package if provided.

### How packages are resolved

`lpm add example@1.3.5` => `example@^1.3.5`

`lpm add example@^1.3.5` => `example@^1.3.5`

`lpm add example@!1.3.5` => `example@1.3.5`

`lpm add example@~1.3.5` => `example@~1.3.5`

`lpm add example@latest` => `example@[latest-published-version]`

You can also use `@current` when trying to update existing packages, this will preserve the current status of the package, for e.g. if it were previously imported and you were to run `lpm add example`, it will switch from an imported package to a normal installation. `lpm add example@current` keeps it as an imported package and makes any required updates.

### Adding flags to package.json

If you want to import a package by adding it to the `package.json` file, you will need to use an `array` for the package instead of a `string` of the version

> "example": "1.3.5" -> "@example": ["1.3.5"]

The first element must be the version. You can then add the flag (currently only `import` & `traverse-imports` are supported) in any order following the version.

> "@example": ["1.3.5", "import", "traverse-imports"]

### Configuring

```sh
lpm config
```

Prompts interactive configuration.

### Preparing

### Releasing

### Hooking git

### Backups

<p  align="right">(<a  href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p  align="right">(<a  href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->

## Contact

[@mekstuff](https://twitter.com/mekstuff) - hello@mekstuff.com

[https://github.com/mekstuff/lpm](https://github.com/mekstuff/lpm)

<p  align="right">(<a  href="#readme-top">back to top</a>)</p>
