module.exports = {
    parser: "@typescript-eslint/parser",
    plugins: [
        'css-modules',
    ],
    extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:css-modules/recommended',
    ],
    parserOptions: {
        ecmaFeatures: {
            jsx: true
        },
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
    },
    ignorePatterns: ['/*.*'],
    rules: {
        '@typescript-eslint/explicit-function-return-type': ['warn', { 'allowExpressions': true }],
        '@typescript-eslint/member-delimiter-style': 'error',
        '@typescript-eslint/naming-convention': [
            'error', {
                selector: ['default', 'variableLike', 'memberLike'],
                format: ['camelCase']
            }, {
                selector: 'parameter',
                format: ['camelCase'],
                leadingUnderscore: 'allow'
            }, {
                selector: 'enumMember',
                format: ['PascalCase'],
            }, {
                selector: 'memberLike',
                modifiers: ['private'],
                format: ['camelCase'],
                leadingUnderscore: 'allow'
            }, {
                selector: 'memberLike',
                modifiers: ['protected'],
                format: ['camelCase'],
                leadingUnderscore: 'allow'
            }, {
                selector: 'typeParameter',
                format: ['PascalCase'],
                prefix: ['T']
            }, {
                selector: 'typeLike',
                format: ['PascalCase'],
            },{
                selector: 'interface',
                format: ['PascalCase'],
                prefix: ['I']
            }, {
                selector: ['variable'],
                modifiers: ['const'],
                format: ['camelCase', 'PascalCase'],
                types: ['function']
            }, {
                selector: ['variable'],
                modifiers: ['global', 'const'],
                format: ['PascalCase']
            }
        ],
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/type-annotation-spacing': 'error',
        'css-modules/no-undef-class': ['error', { camelCase: true }],
        'css-modules/no-unused-class': ['error', { camelCase: true }],
        'arrow-body-style': ['warn', 'as-needed'],
        'brace-style': 'error',
        'curly': 'error',
        'indent': ['error', 4, { 'SwitchCase': 1 }],
        'jsx-quotes': ['warn', 'prefer-double'],
        'no-console': 'error',
        'no-multiple-empty-lines': ['warn', { 'max': 2, 'maxEOF': 1 }],
        'no-trailing-spaces': 'warn',
        'object-curly-spacing': ['warn', 'always'],
        'operator-linebreak': 'error',
        'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
        'padded-blocks': ['warn', 'never'],
        'prefer-destructuring': 'warn',
        'prefer-spread': 'warn',
        'semi': 'error',
        'space-before-blocks': 'error',
        'react/self-closing-comp': 'warn',
        'react/jsx-curly-spacing': 'warn',
        'react/jsx-handler-names': 'warn',
        'react/jsx-no-useless-fragment': 'warn',
        'react/jsx-tag-spacing': 'error',
        'react/prop-types': 'off'
    },
    'settings': {
        'react': {
            'version': 'detect'
        }
    }
}