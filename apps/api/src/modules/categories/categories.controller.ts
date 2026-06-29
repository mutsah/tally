import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Category } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { GetUser } from 'src/common/decorators/get-user.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('categories')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a category for the current user' })
  create(
    @GetUser('id') userId: string,
    @Body() dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List the current user's categories (children under their parent)",
  })
  findAll(@GetUser('id') userId: string): Promise<Category[]> {
    return this.categoriesService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the current user’s categories' })
  @ApiNotFoundResponse({
    description: 'Category not found or not owned by user',
  })
  findOne(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Category> {
    return this.categoriesService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or re-parent one of your categories' })
  @ApiNotFoundResponse({
    description: 'Category not found or not owned by user',
  })
  update(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one of your categories' })
  @ApiNotFoundResponse({
    description: 'Category not found or not owned by user',
  })
  remove(
    @GetUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Category> {
    return this.categoriesService.remove(userId, id);
  }
}
