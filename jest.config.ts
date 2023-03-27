export default{
    "testRegex": [
      "./*\\.test.js$",
      "./*\\.test.ts$"
    ],
    "setupFiles": [
      "jest-webgl-canvas-mock",
      "jsdom-worker"
    ],
    "coverageReporters": [
      "lcov",
      "text"
    ],
    reporters: [
      'default',
      'jest-bench',
      ['github-actions', {silent: false}],
      'summary'
    ]
}