// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'modules/*/android/*'],
    rules: {
      // 폼 입력 동기화(통장 자동 선택 등)와 초기 DB 로딩은 effect 안에서 상태를 맞추는 게 의도된 동작이다
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
