import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  NationalTeam,
  NationalTeamDocument,
} from '../model/national-team.schema';
import { toObjectId, toObjectIds } from '../../common/objectid.util';

@Injectable()
export class NationalTeamRepository {
  constructor(
    @InjectModel(NationalTeam.name)
    private readonly model: Model<NationalTeamDocument>,
  ) {}

  async find(
    options: { skip?: number; take?: number; where?: any } = {},
  ): Promise<NationalTeam[]> {
    let query = this.model.find(options.where || {});
    if (options.skip !== undefined) query = query.skip(options.skip);
    if (options.take !== undefined) query = query.limit(options.take);
    return query.exec();
  }

  async findOne(options: { where: any }): Promise<NationalTeam | null> {
    return this.model.findOne(options.where).exec();
  }

  async findById(id: string): Promise<NationalTeam | null> {
    return this.model.findById(toObjectId(id)).exec();
  }

  create(data: Partial<NationalTeam>): NationalTeam {
    return new this.model(data) as any;
  }

  async save<T extends NationalTeam | NationalTeam[]>(
    entityOrEntities: T,
  ): Promise<T> {
    if (Array.isArray(entityOrEntities)) {
      const saved = await Promise.all(
        entityOrEntities.map(async (e) => {
          if ((e as any).save) {
            return (e as any).save();
          }
          return this.model.create(e);
        }),
      );
      return saved as any;
    } else {
      if ((entityOrEntities as any).save) {
        return (entityOrEntities as any).save();
      }
      return this.model.create(entityOrEntities) as any;
    }
  }

  async update(id: string, data: Partial<NationalTeam>): Promise<void> {
    await this.model.updateOne({ _id: toObjectId(id) }, { $set: data }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.model.deleteOne({ _id: toObjectId(id) }).exec();
  }
}
