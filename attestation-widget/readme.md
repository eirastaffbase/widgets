The Most Minimal Widget



By Deane Barker

1 min

12

clapping hands
1
Attached to this page is a zip file containing the (almost) minimal code required to create a custom widget.

Unzip the folder

Run npm install

Run npm run build

The file which appears in /dist is the widget that can be registered.

All of the functional code is in hello-widget.ts. Any other code just exists to perform the build or maintain the libraries.

This widget has been stripped of (almost) everything except what’s required for minimal functionality.   I started with the default widget created by the npx script, then kept deleting things until it broke, putting things back, figuring out what they were and why they existed, etc.

There are lots of comments explaining what everything is.

The only “extra” thing I included was an example of uiSchema. You technically don’t need this, but it’s pretty foundational, so I decided to include it.

If there’s anything you don’t understand, or anything that would benefit from some more comments, please let me know.