import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_NAME', 'agent_patterns'),
        entities: [__dirname + '/../**/*.entity.{js,ts}'],
        synchronize: configService.get('DB_SYNC', 'true') === 'true',
        logging: configService.get('DB_LOGGING', 'false') === 'true',
        migrations: [__dirname + '/migrations/*.{js,ts}'],
        migrationsRun: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
