class EyesSourceMap {
  /**
   * @param {Object} options 配置选项
   * @param {String} options.token 项目唯一token 必填
   * @param {String} options.dsn sourceMap上传地址 必填
   * @param {Boolean} options.productionSourceMap 生产环境是否保留sourceMap
   * @param {Array} options.uploadScript 需要上传sourceMap的命令 可选，默认 ['vue-cli-service build']
   * @param {Number} options.concurrency 并发数量限制，可选，默认值为 5
   * @param {String} options.api 上传接口url，可选，默认值为/api/upload/sourcemap
   */
  constructor(options) {
    this.token = options.token;
    this.dsn = options.dsn.replace(/\/$/, ''); // 确保 dsn 没有结尾斜杠
    this.productionSourceMap = options.productionSourceMap || false;
    this.uploadScript = ['vue-cli-service build'].concat(options.uploadScript || []);
    this.npm_lifecycle_script = process.env.npm_lifecycle_script;
    this.concurrency = options.concurrency || 5; // 默认并发数量为 5
    this.api = options.api || '/api/upload/sourcemap';

    this.checkParams('dsn');
    this.checkParams('token');
  }

  // 检查参数是否存在
  checkParams(name) {
    if (!this[name]) {
      throw new Error(`插件：eyes-upload-map 参数 ${name} 必填！`);
    }
  }

  // 上传 map 文件
  async upLoadMap(data, name) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30 * 1000); // 超时时间 30s
    

    const formData = new FormData();
    formData.append('file', new Blob([data]), name);
    formData.append('apiKey', this.token);
    
    try {
      const response = await fetch(`${this.dsn}${this.api}`, {
        method: 'POST',
        body: formData,
        // headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status !== 200) {
        console.warn(`上传失败：${response.status}（文件名：${name}）`);
        return null;
      }
      console.log(`文件名：${name}上传完成`);
      return response.json();
    } catch (error) {
      console.warn(`上传过程中出错：${error.message}（文件名：${name}）`);
      return null;
    }
  }

  // 判断是否需要上传
  checkUpload() {
    return this.uploadScript.some((item) => this.npm_lifecycle_script.includes(item));
  }

  // 控制并发上传任务
  async limitedConcurrency(tasks, limit) {
    const activeTasks = [];
    const results = [];

    for (const task of tasks) {
      const promise = task().catch((err) => err); // 捕获错误以避免中断
      results.push(promise);

      const execute = promise.finally(() => activeTasks.splice(activeTasks.indexOf(execute), 1));
      activeTasks.push(execute);

      if (activeTasks.length >= limit) {
        await Promise.race(activeTasks); // 等待最快完成的任务
      }
    }

    return Promise.allSettled(results)
  }

  // Webpack 的 apply 方法
  apply(compiler) {
    compiler.hooks.emit.tapAsync('EyesUpLoadMap', async (compilation, next) => {
      if (!this.checkUpload()) {
        return next();
      }

      const mapFiles = compilation
        .getAssets()
        .filter(({ name }) => /\.map$/.test(name)); // 筛选出所有 .map 文件

      // 创建上传任务列表
      const uploadTasks = mapFiles.map(({ source, name }) => () =>
        this.upLoadMap(source.source(), name)
      );

      try {
        // 使用并发控制上传文件
        await this.limitedConcurrency(uploadTasks, this.concurrency);
        console.log('所有 sourceMap 文件上传完成');
      } catch (error) {
        console.error('上传过程中出错:', error);
      }

      // 如果不需要保留 sourceMap，则删除它们
      if (!this.productionSourceMap) {
        for (const { name } of mapFiles) {
          delete compilation.assets[name];
        }
      }

      next();
    });
  }
}

module.exports = EyesSourceMap;
