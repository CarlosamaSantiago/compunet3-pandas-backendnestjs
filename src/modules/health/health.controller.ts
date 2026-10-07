import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';

export interface HealthResponse {
  status: 'ok';
}

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check whether the API is running' })
  @ApiOkResponse({
    description: 'The API is healthy.',
    schema: { example: { status: 'ok' } },
  })
  check(): HealthResponse {
    return { status: 'ok' };
  }
}