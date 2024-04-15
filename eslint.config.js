// eslint.config.js
module.exports = {
	// root: true, // Don't look outside this project for inherited configs
    extends: [
        "eslint:recommended"
    ],
    plugins: [],
    env: {
        "es6": true,
        "node": true,
        "mocha": true
    },
    rules: {
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1
            }
        ],
        "no-console": "off",
        "no-var": "error",
        "prefer-const": "error",
        "quotes": [
            "error",
            "single",
            {
                "avoidEscape": true,
                "allowTemplateLiterals": true
            }
        ],
        "semi": [
            "error",
            "always"
        ],
        "prettier/prettier": [
			"error",
			{
				endOfLine: "auto",
			},
		]
    },
    parserOptions: {
		ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
    },
}
