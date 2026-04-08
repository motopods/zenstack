import { describe, expect, it } from 'vitest';
import { DataModel } from '../src/ast';
import { isDelegateModel } from '../src/utils';
import { loadSchema, loadSchemaWithError } from './utils';

describe('Delegate Tests', () => {
    it('supports inheriting from delegate', async () => {
        const model = await loadSchema(`
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A {
            id Int @id @default(autoincrement())
            x String
            @@delegate(x)
        }

        model B extends A {
            y String
        }
        `);
        const a = model.declarations.find((d) => d.name === 'A') as DataModel;
        expect(a.baseModel).toBeUndefined();
        const b = model.declarations.find((d) => d.name === 'B') as DataModel;
        expect(b.baseModel?.ref).toBe(a);
    });

    it('rejects inheriting from non-delegate models', async () => {
        await loadSchemaWithError(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A {
            id Int @id @default(autoincrement())
            x String
        }

        model B extends A {
            y String
        }
        `,
            'not a delegate model',
        );
    });

    it('can detect cyclic inherits', async () => {
        await loadSchemaWithError(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A extends B {
            x String
            @@delegate(x)
        }

        model B extends A {
            y String
            @@delegate(y)
        }
        `,
            'cyclic',
        );
    });

    it('can detect duplicated fields from base model', async () => {
        await loadSchemaWithError(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A {
            id String @id
            x String
            @@delegate(x)
        }

        model B extends A {
            x String
        }
        `,
            'duplicated',
        );
    });

    it('can detect duplicated attributes from base model', async () => {
        await loadSchemaWithError(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A {
            id String @id
            x String
            @@id([x])
            @@delegate(x)
        }

        model B extends A {
            y String
            @@id([y])
        }
        `,
            'can only be applied once',
        );
    });

    it('rejects relation missing the opposite side', async () => {
        await loadSchemaWithError(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A {
            id Int @id @default(autoincrement())
            b B @relation(fields: [bId], references: [id])
            bId Int
            type String
            @@delegate(type)
        }

        model B {
            id Int @id @default(autoincrement())
        }
        `,
            'missing an opposite relation',
        );

        await loadSchema(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }
        
        model A {
            id Int @id @default(autoincrement())
            b B @relation(fields: [bId], references: [id])
            bId Int
            type String
            @@delegate(type)
        }

        model B {
            id Int @id @default(autoincrement())
            a A[]
        }

        model C extends A {
            c String
        }
        `,
        );
    });

    it('supports enum discriminator value via string literal', async () => {
        await loadSchema(`
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }

        enum ContentType {
            Image
            Video
        }

        model Content {
            id   Int         @id @default(autoincrement())
            type ContentType
            @@delegate(type)
        }

        model ImageContent extends Content {
            url String
            @@delegateMap("Image")
        }

        model VideoContent extends Content {
            src String
            @@delegateMap("Video")
        }
        `);
    });

    it('supports enum discriminator value via enum field reference', async () => {
        await loadSchema(`
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }

        enum ContentType {
            Image
            Video
        }

        model Content {
            id   Int         @id @default(autoincrement())
            type ContentType
            @@delegate(type)
        }

        model ImageContent extends Content {
            url String
            @@delegateMap(Image)
        }

        model VideoContent extends Content {
            src String
            @@delegateMap(Video)
        }
        `);
    });

    it('@@delegateMap child model is not a delegate model', async () => {
        const model = await loadSchema(`
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }

        enum ContentType {
            Image
            Video
        }

        model Content {
            id   Int         @id @default(autoincrement())
            type ContentType
            @@delegate(type)
        }

        model ImageContent extends Content {
            url String
            @@delegateMap("Image")
        }
        `);

        const content = model.declarations.find((d) => d.name === 'Content') as DataModel;
        const image = model.declarations.find((d) => d.name === 'ImageContent') as DataModel;

        // Content should be a delegate (has @@delegate)
        expect(isDelegateModel(content)).toBe(true);
        // ImageContent should NOT be treated as a delegate (only has @@delegateMap, no @@delegate)
        expect(isDelegateModel(image)).toBe(false);
        // But ImageContent has baseModel pointing to Content
        expect(image.baseModel?.ref).toBe(content);
    });

    it('rejects @@delegateMap on a non-child model', async () => {
        await loadSchemaWithError(
            `
        datasource db {
            provider = 'sqlite'
            url      = 'file:./dev.db'
        }

        model Standalone {
            id Int @id @default(autoincrement())
            @@delegateMap("foo")
        }
        `,
            'can only be used on a model that extends a delegate model',
        );
    });
});
