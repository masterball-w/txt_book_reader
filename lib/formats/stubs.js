/**
 * 暂未支持的格式占位适配器（导入时给出明确提示）。
 */

function makeStub(id, extensions, label) {
  return {
    id,
    extensions,
    todo: true,
    message: `${label} 格式暂未支持，敬请期待`,
    async extractText() {
      throw new Error(this.message);
    }
  };
}

const stubs = [
  makeStub('pdf', ['pdf'], 'PDF'),
  makeStub('azw3', ['azw3', 'kf8'], 'AZW3/KF8'),
  makeStub('fb2', ['fb2'], 'FB2'),
  makeStub('azw', ['azw'], 'AZW'),
  makeStub('djvu', ['djvu'], 'DjVu')
];

module.exports = stubs;
