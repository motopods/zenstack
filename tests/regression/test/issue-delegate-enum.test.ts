import { createTestClient } from '@zenstackhq/testtools';
import { describe, expect, it } from 'vitest';

// Feature: @@delegate discriminator value support for enum types
// When the discriminator field is an enum type, the model name may not match the enum value.
// @@delegate(field, enumValue) allows specifying the exact discriminator value to use.
describe('@@delegate with enum discriminator value', () => {
    it('writes the specified enum value as discriminator on create', async () => {
        const db = await createTestClient(
            `
enum ContentType {
    Image
    Video
}

model Content {
    id   Int         @id @default(autoincrement())
    type ContentType
    @@delegate(type)
}

model ImagePost extends Content {
    url String
    @@delegate(type, Image)
}

model VideoPost extends Content {
    src String
    @@delegate(type, Video)
}
        `,
            { usePrismaPush: true },
        );

        const image = await db.imagePost.create({ data: { url: 'http://example.com/img.png' } });
        expect(image.type).toBe('Image');

        const video = await db.videoPost.create({ data: { src: 'http://example.com/vid.mp4' } });
        expect(video.type).toBe('Video');
    });

    it('writes the specified string literal value as discriminator on create', async () => {
        const db = await createTestClient(
            `
enum ContentType {
    Image
    Video
}

model Content {
    id   Int         @id @default(autoincrement())
    type ContentType
    @@delegate(type)
}

model ImagePost extends Content {
    url String
    @@delegate(type, "Image")
}

model VideoPost extends Content {
    src String
    @@delegate(type, "Video")
}
        `,
            { usePrismaPush: true },
        );

        const image = await db.imagePost.create({ data: { url: 'http://example.com/img.png' } });
        expect(image.type).toBe('Image');

        const video = await db.videoPost.create({ data: { src: 'http://example.com/vid.mp4' } });
        expect(video.type).toBe('Video');
    });

    it('uses model name as discriminator when no value is specified (backward compatibility)', async () => {
        const db = await createTestClient(
            `
model Content {
    id   Int    @id @default(autoincrement())
    type String
    @@delegate(type)
}

model ImagePost extends Content {
    url String
}

model VideoPost extends Content {
    src String
}
        `,
        );

        const image = await db.imagePost.create({ data: { url: 'http://example.com/img.png' } });
        expect(image.type).toBe('ImagePost');

        const video = await db.videoPost.create({ data: { src: 'http://example.com/vid.mp4' } });
        expect(video.type).toBe('VideoPost');
    });

    it('supports createMany with enum discriminator value', async () => {
        const db = await createTestClient(
            `
enum ContentType {
    Image
    Video
}

model Content {
    id   Int         @id @default(autoincrement())
    type ContentType
    @@delegate(type)
}

model ImagePost extends Content {
    url String
    @@delegate(type, Image)
}
        `,
            { usePrismaPush: true },
        );

        await db.imagePost.createMany({
            data: [
                { url: 'http://example.com/img1.png' },
                { url: 'http://example.com/img2.png' },
            ],
        });

        const images = await db.imagePost.findMany();
        expect(images).toHaveLength(2);
        expect(images[0]!.type).toBe('Image');
        expect(images[1]!.type).toBe('Image');
    });
});
