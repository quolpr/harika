import { FastifyPluginCallback } from 'fastify';

import { minioClient } from '../minioClient';

export const uploadHandler: FastifyPluginCallback = (server, options, next) => {
  server.post('/upload', async (req, res) => {
    const parts = req.files();

    for await (const part of parts) {
      await minioClient.putObject('uploads', part.filename, part.file, {
        'Content-Type': part.mimetype,
      });
    }

    res.status(201).send();
  });

  next();
};
