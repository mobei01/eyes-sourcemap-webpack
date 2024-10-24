import axios from 'axios'
import FormData from 'form-data'

class EyesSourceMap {
  /**
   * @param {Object} options
   * @param {String} options.token Project unique token (required)
   * @param {String} options.dsn SourceMap upload address (required)
   * @param {Boolean} options.productionSourceMap Whether to keep sourceMap in production environment
   * @param {Array} options.uploadScript Commands that need to upload sourceMap (optional, default: ['vue-cli-service build'])
   * @param {Number} options.concurrency Concurrency limit (optional, default: 5)
   * @param {String} options.api Upload interface URL (optional, default: /api/upload/sourcemap)
   * @param {String} options.logger Enable logging (Optional, default: true)
   */
  constructor(options) {
    this.token = options.token;
    this.dsn = options.dsn.replace(/\/$/, '');
    this.productionSourceMap = options.productionSourceMap || false;
    this.uploadScript = ['vue-cli-service build'].concat(options.uploadScript || []);
    this.npm_lifecycle_script = process.env.npm_lifecycle_script;
    this.concurrency = options.concurrency || 5;
    this.api = options.api || '/api/upload/sourcemap';
    this.logger = options.logger || true;
    

    this.checkParams('dsn');
    this.checkParams('token');
  }


  checkParams(name) {
    if (!this[name]) {
      throw new Error(`Plugin: eyes-upload-map Parameter ${name} is required!`);
    }
  }


  async upLoadMap(data, name) {
    const formData = new FormData();
    formData.append('file', Buffer.from(data), name);
    formData.append('apiKey', this.token);
    
    try {
      const response = await axios.post(`${this.dsn}${this.api}`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000, // 30s
      });

      if (response.status !== 200) {
        this.logger && console.warn(`Upload failed: ${response.status} (filename: ${name})`);
        return null;
      }
      this.logger && console.log(`Filename: ${name} upload complete`);
      return response.data;
    } catch (error) {
      this.logger && console.warn(`Error during upload: ${error.message} (filename: ${name})`);
      return null;
    }
  }


  checkUpload() {
    return this.uploadScript.some((item) => this.npm_lifecycle_script.includes(item));
  }

  async limitedConcurrency(tasks, limit) {
    const activeTasks = [];
    const results = [];

    for (const task of tasks) {
      const promise = task().catch((err) => {
        this.logger && console.error(`Error during upload: ${err.message} (filename: ${task.name})`);
        return err
      });
      results.push(promise);

      const execute = promise.finally(() => activeTasks.splice(activeTasks.indexOf(execute), 1));
      activeTasks.push(execute);

      if (activeTasks.length >= limit) {
        await Promise.race(activeTasks);
      }
    }

    return Promise.allSettled(results)
  }

  apply(compiler) {
    compiler.hooks.emit.tapAsync('EyesUpLoadMap', async (compilation, next) => {
      if (!this.checkUpload()) {
        return next();
      }

      const mapFiles = compilation
        .getAssets()
        .filter(({ name }) => /\.map$/.test(name));

      const uploadTasks = mapFiles.map(({ source, name }) => () =>
        this.upLoadMap(source.source(), name)
      );

      try {
        await this.limitedConcurrency(uploadTasks, this.concurrency);
        this.logger && console.log('All sourceMap files uploaded');
      } catch (error) {
        this.logger && console.error('Error during upload:', error);
      }

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
