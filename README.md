# sepco-assets

Hashed CSS and JS for the SepcoTech pages, served through jsDelivr **pinned to a commit**:

    https://cdn.jsdelivr.net/gh/renemeisel1984-cmd/sepco-assets@<commit>/<brand>/<file>

Rules
- CSS and JS only. Never images (images live in sepco-media).
- File names carry a content hash and are never overwritten; a changed file gets a new name.
- Pages always load a commit-pinned URL, never `@main`.
- Keep this repository far below jsDelivr's 50 MB package limit.
