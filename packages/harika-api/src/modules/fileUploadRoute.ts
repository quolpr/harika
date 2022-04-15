import { FastifyPluginCallback } from 'fastify';

import { getSessionFromRequestStrict } from '../helpers/getSessionFromRequest';
import { S3Client } from '../S3Client';

const uploadsBucket = process.env.S3_UPLOADS_BUCKET_NAME;

export const uploadHandler: FastifyPluginCallback = (server, options, next) => {
  server.post('/upload', async (req, res) => {
    const userId = (await getSessionFromRequestStrict(req)).identity.id;
    const parts = req.parts();

    let fileId: string | undefined = undefined;
    let fileSize: number | undefined = undefined;

    console.log({ parts });
    for await (const part of parts) {
      if (part.file) {
        if (!fileId) {
          res.status(500).send({
            error: 'fileId not found. It should be present before file',
          });
          return;
        }

        if (!fileSize) {
          res.status(500).send({
            error: 'fileSize not found. It should be present before file',
          });
          return;
        }

        const filePath = `${userId}/${fileId}/${part.filename}`;

        await S3Client.putObject({
          Body: part.file,
          Bucket: uploadsBucket,
          Key: filePath,
          ContentType: part.mimetype,
          ContentLength: fileSize,
        });

        res.status(201).send({
          url: `${process.env.S3_PUBLIC_URL}/${uploadsBucket}/${filePath}`,
        });
        return;
      } else {
        if (part.fieldname === 'fileId' && 'value' in part) {
          fileId = (part as any).value;
        } else if (part.fieldname === 'fileSize' && 'value' in part) {
          fileSize = (part as any).value;
        }
      }
    }

    res.status(500).send();
  });

  server.delete('/upload', async (req, res) => {
    res.status(200).send();
  });

  next();
};
