# Internal development documents

This folder is **outside** Vite's `public/` directory on purpose.

Files here (including the original AI Studio prompt document) are internal
development references. They are not part of the product UI and must not be
copied into the production build output. Vite copies everything under `public/`
verbatim, so internal prompts belong here instead.

Nothing in the application references these files at runtime.
