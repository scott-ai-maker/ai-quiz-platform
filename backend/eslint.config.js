module.exports = [
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
                require: 'readonly'
            }
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-console': 'off',
            'semi': ['error', 'always'],
            'quotes': ['error', 'single']
        }
    }
];