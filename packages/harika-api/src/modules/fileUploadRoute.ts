import { FastifyPluginCallback } from 'fastify';

import { getSessionFromRequestStrict } from '../helpers/getSessionFromRequest';
import { minioClient } from '../minioClient';

const uploadsBucket = 'uploads';

export const uploadHandler: FastifyPluginCallback = (server, options, next) => {
  server.post('/upload', async (req, res) => {
    const userId = (await getSessionFromRequestStrict(req)).identity.id;
    const parts = req.parts();

    let fileId: string | undefined = undefined;

    console.log({ parts });
    for await (const part of parts) {
      if (part.file) {
        if (!fileId) {
          res.status(500).send({
            error: 'fileId not found. It should be present as a first field.',
          });
          return;
        }

        const filePath = `${userId}/${fileId}/${part.filename}`;
        await minioClient.putObject(uploadsBucket, filePath, part.file, {
          'Content-Type': part.mimetype,
        });

        res
          .status(201)
          .send({
            url: `${process.env.S3_PUBLIC_URL}/${uploadsBucket}/${filePath}`,
          });

        return;
      } else {
        if (part.fieldname === 'fileId' && 'value' in part) {
          fileId = (part as any).value;
        }
      }
    }

    res.status(500).send();
  });

  next();
};
