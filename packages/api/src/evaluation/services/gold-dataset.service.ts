import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AgentPattern } from '../enums/agent-pattern.enum';
import { GoldSample, GoldDatasetMetadata, HumanScore } from '../interfaces/gold-dataset.interface';

@Injectable()
export class GoldDatasetService {
  private readonly logger = new Logger(GoldDatasetService.name);
  private readonly datasetPath = join(process.cwd(), 'data', 'gold-datasets');
  private readonly currentVersion = '1.0.0';

  async ensureDatasetDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.datasetPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create dataset directory', error);
    }
  }

  async createSample(
    pattern: AgentPattern,
    input: GoldSample['input'],
    expectedOutput?: GoldSample['expectedOutput'],
    complexity: GoldSample['complexity'] = 'medium',
    edgeCase = false,
    tags: string[] = [],
  ): Promise<GoldSample> {
    const sample: GoldSample = {
      id: uuidv4(),
      pattern,
      version: this.currentVersion,
      createdAt: new Date(),
      input,
      expectedOutput,
      humanScores: [],
      complexity,
      edgeCase,
      tags,
    };

    await this.saveSample(sample);
    return sample;
  }

  async getSample(pattern: AgentPattern, sampleId: string): Promise<GoldSample> {
    const filePath = this.getSamplePath(pattern, sampleId);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new NotFoundException(`Sample ${sampleId} not found for pattern ${pattern}`);
    }
  }

  async getPatternSamples(
    pattern: AgentPattern,
    limit?: number,
    stratified = true,
  ): Promise<GoldSample[]> {
    const patternDir = join(this.datasetPath, pattern);
    try {
      const files = await fs.readdir(patternDir);
      const sampleFiles = files.filter((f) => f.endsWith('.json') && f !== 'metadata.json');

      const samples: GoldSample[] = [];
      for (const file of sampleFiles) {
        const data = await fs.readFile(join(patternDir, file), 'utf-8');
        samples.push(JSON.parse(data));
      }

      if (stratified) {
        return this.stratifySamples(samples, limit);
      }

      return limit ? samples.slice(0, limit) : samples;
    } catch (error) {
      this.logger.error(`Failed to get samples for pattern ${pattern}`, error);
      return [];
    }
  }

  async addHumanScore(
    pattern: AgentPattern,
    sampleId: string,
    humanScore: HumanScore,
  ): Promise<GoldSample> {
    const sample = await this.getSample(pattern, sampleId);
    sample.humanScores.push(humanScore);
    await this.saveSample(sample);
    return sample;
  }

  async getMetadata(pattern: AgentPattern): Promise<GoldDatasetMetadata> {
    const samples = await this.getPatternSamples(pattern);
    const evaluatorIds = new Set<string>();
    let totalAgreement = 0;
    let agreementCount = 0;

    const complexityDist = { low: 0, medium: 0, high: 0 };

    for (const sample of samples) {
      complexityDist[sample.complexity]++;
      sample.humanScores.forEach((score) => evaluatorIds.add(score.evaluatorId));

      if (sample.humanScores.length >= 2) {
        const agreement = this.calculatePairwiseAgreement(sample.humanScores);
        totalAgreement += agreement;
        agreementCount++;
      }
    }

    return {
      version: this.currentVersion,
      createdAt: samples[0]?.createdAt || new Date(),
      lastUpdated: new Date(),
      pattern,
      sampleCount: samples.length,
      humanEvaluatorCount: evaluatorIds.size,
      averageInterRaterAgreement: agreementCount > 0 ? totalAgreement / agreementCount : 0,
      complexityDistribution: complexityDist,
    };
  }

  private async saveSample(sample: GoldSample): Promise<void> {
    await this.ensureDatasetDirectory();
    const patternDir = join(this.datasetPath, sample.pattern);
    await fs.mkdir(patternDir, { recursive: true });

    const filePath = this.getSamplePath(sample.pattern, sample.id);
    await fs.writeFile(filePath, JSON.stringify(sample, null, 2));
  }

  private getSamplePath(pattern: AgentPattern, sampleId: string): string {
    return join(this.datasetPath, pattern, `${sampleId}.json`);
  }

  private stratifySamples(samples: GoldSample[], limit?: number): GoldSample[] {
    const grouped = {
      low: samples.filter((s) => s.complexity === 'low'),
      medium: samples.filter((s) => s.complexity === 'medium'),
      high: samples.filter((s) => s.complexity === 'high'),
    };

    if (!limit) return samples;

    const perGroup = Math.floor(limit / 3);
    const remainder = limit % 3;

    const result: GoldSample[] = [];
    result.push(...this.shuffleArray(grouped.low).slice(0, perGroup));
    result.push(...this.shuffleArray(grouped.medium).slice(0, perGroup + (remainder > 0 ? 1 : 0)));
    result.push(...this.shuffleArray(grouped.high).slice(0, perGroup + (remainder > 1 ? 1 : 0)));

    return this.shuffleArray(result);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private calculatePairwiseAgreement(scores: HumanScore[]): number {
    if (scores.length < 2) return 1;

    let totalAgreement = 0;
    let pairCount = 0;

    for (let i = 0; i < scores.length - 1; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        const diff = Math.abs(scores[i].scores.overall - scores[j].scores.overall);
        const agreement = 1 - diff / 10; // Assuming 0-10 scale
        totalAgreement += Math.max(0, agreement);
        pairCount++;
      }
    }

    return pairCount > 0 ? totalAgreement / pairCount : 0;
  }
}
