module.exports = {
	root: true, // Don't look outside this project for inherited configs
	parser: "@typescript-eslint/parser", // Specifies the ESLint parser
	parserOptions: {
		ecmaVersion: 2020, // Allows for the parsing of modern ECMAScript features
		
		
	},
	extends: [
        "eslint:recommended"
 
	],
	plugins: [],
	rules: {
        "indent": [
            "error",
            4,
            {
                "SwitchCase": 1
            }
        ],
        "no-console": "off",
		"@typescript-eslint/no-unused-vars": [
			"error",
			{
				ignoreRestSiblings: true,
				argsIgnorePattern: "^_",
			},
		],
		"prettier/prettier": [
			"error",
			{
				endOfLine: "auto",
			},
		],
		"@typescript-eslint/no-object-literal-type-assertion": "off",
		"@typescript-eslint/interface-name-prefix": "off",
		"@typescript-eslint/no-non-null-assertion": "off", // This is necessary for Map.has()/get()!
		"no-var": "error",
		"prefer-const": "error",
		"no-trailing-spaces": "error",
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
        ]
    },
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
}
