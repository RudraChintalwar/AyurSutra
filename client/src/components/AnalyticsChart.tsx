import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  Share,
  MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalyticsChartProps {
  title: string;
  description?: string;
  data: any[];
  type: 'line' | 'area' | 'bar' | 'pie';
  height?: number;
  showActions?: boolean;
  className?: string;
  dataKeys?: string[];
  colors?: string[];
  showTrend?: boolean;
  trendValue?: number;
  trendLabel?: string;
}

const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  title,
  description,
  data,
  type = 'line',
  height = 300,
  showActions = true,
  className,
  dataKeys = [],
  colors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--muted-foreground))'],
  showTrend = false,
  trendValue = 0,
  trendLabel = ''
}) => {
  const defaultColors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))', 
    'hsl(var(--destructive))',
    'hsl(var(--muted-foreground))',
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300'
  ];

  const chartColors = colors.length > 0 ? colors : defaultColors;

  const renderChart = () => {
    switch (type) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend />
              {dataKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stackId="1"
                  stroke={chartColors[index % chartColors.length]}
                  fill={chartColors[index % chartColors.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend />
              {dataKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={chartColors[index % chartColors.length]}
                  radius={[2, 2, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default: // line
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="date" 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                className="text-xs text-muted-foreground"
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend />
              {dataKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2}
                  dot={{ fill: chartColors[index % chartColors.length], strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: chartColors[index % chartColors.length], strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
    }
  };

  const getChartIcon = () => {
    switch (type) {
      case 'area':
      case 'line':
        return <LineChartIcon className="w-4 h-4" />;
      case 'bar':
        return <BarChart3 className="w-4 h-4" />;
      case 'pie':
        return <PieChartIcon className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  return (
    <Card className={cn('ayur-card p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            {getChartIcon()}
          </div>
          <div>
            <h3 className="font-playfair text-lg font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {showTrend && (
            <div className="flex items-center space-x-1">
              {trendValue > 0 ? (
                <TrendingUp className="w-4 h-4 text-green-600" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-600" />
              )}
              <Badge 
                variant="secondary" 
                className={cn(
                  'text-xs',
                  trendValue > 0 ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
                )}
              >
                {trendValue > 0 ? '+' : ''}{trendValue}% {trendLabel}
              </Badge>
            </div>
          )}

          {showActions && (
            <div className="flex items-center space-x-1">
              <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                <Share className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="p-1 h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="w-full">
        {renderChart()}
      </div>

      {/* Legend for pie charts */}
      {type === 'pie' && dataKeys.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {dataKeys.map((key, index) => (
            <div key={key} className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: chartColors[index % chartColors.length] }}
              />
              <span className="text-xs text-muted-foreground capitalize">{key}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default AnalyticsChart;