module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/scripts'],
    testMatch: ['**/*.test.ts', '**/*.test.js'],
    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
    },
    moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    },
};
