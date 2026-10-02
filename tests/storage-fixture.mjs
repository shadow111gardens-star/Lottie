export class MemoryS3 {
  objects = new Map();
  failDelete = false;
  async send(command) {
    const input = command.input;
    switch (command.constructor.name) {
      case 'PutObjectCommand': this.objects.set(input.Key, { body: Buffer.from(input.Body), type: input.ContentType }); return {};
      case 'GetObjectCommand': {
        const object = this.objects.get(input.Key);
        if (!object) throw Object.assign(new Error('missing'), { name: 'NoSuchKey' });
        return { Body: { transformToByteArray: async () => object.body }, ContentType: object.type };
      }
      case 'ListObjectsV2Command': return { Contents: [...this.objects.keys()].filter(key => key.startsWith(input.Prefix)).map(Key => ({ Key })) };
      case 'CopyObjectCommand': {
        const key = decodeURIComponent(input.CopySource.slice(input.CopySource.indexOf('/') + 1));
        const object = this.objects.get(key); if (!object) throw new Error('Missing copy source.');
        this.objects.set(input.Key, { body: Buffer.from(object.body), type: object.type }); return {};
      }
      case 'DeleteObjectsCommand':
        if (this.failDelete) return { Errors: [{ Code: 'AccessDenied' }] };
        for (const item of input.Delete.Objects) this.objects.delete(item.Key); return {};
      default: throw new Error('Unsupported storage command.');
    }
  }
}
