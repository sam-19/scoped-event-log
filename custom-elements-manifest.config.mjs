/**
 * Custom elements manifest configuration.
 *
 * The analyzer globs the whole package and the manifest ships in `files`, so anything it finds outside
 * the source becomes published metadata. Two directories make that unsafe: the coverage reporter
 * writes its own scripts under `tests/`, which ties the manifest to whether the suite ran before the
 * build and names files the tarball does not carry, and `dist/` and `umd/` hold build output that is
 * absent from a clean clone, so including them makes the manifest unreproducible. The declarations
 * they contribute are duplicates of the source ones with their identifiers mangled.
 */

export default {
    exclude: ['tests/**', 'dist/**', 'umd/**', 'vite.config.*.ts'],
}
