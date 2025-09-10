// eslint-disable-next-line no-undef
module.exports = {
  setupFilesAfterEnv: ["./test/jest-setup.js"],
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.svg": "<rootDir>/__mocks__/svg.js",
    "^nanoid(/(.*)|$)": "nanoid$1",
  },
  transformIgnorePatterns: ["\\/node_modules\\/(?!(nanoid))\\/"],
};
