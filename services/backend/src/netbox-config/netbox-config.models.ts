export type NetboxAttributeType = 'string' | 'number' | 'integer' | 'boolean';

export type NetboxAttributeDefinition = {
  required?: boolean;
  maxLength?: number;
  type?: NetboxAttributeType;
  pattern?: string;
  value?: Array<string | number | boolean>;
  label?: string[];
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
};

export type NetboxModelConfig = {
  version: number | string;
  roots: Record<string, { description?: string }>;
  entities: Record<
    string,
    {
      meta?: Record<string, unknown>;
      parent?: {
        required?: boolean;
        allowed?: Array<{ root?: string; entity?: string; field?: string }>;
      };
      links?: Record<string, { entity: string; field: string; required?: boolean }>;
      attributes?: Record<string, NetboxAttributeDefinition>;
    }
  >;
};

export type NetboxToMermaidConfig = {
  version: number | string;
  kind: string;
  globals?: {
    indentation?: string;
    line_separator?: string;
    anchors?: {
      enabled?: boolean;
      start?: string;
      end?: string;
    };
  };
  roots: Record<
    string,
    {
      mermaid: {
        type: 'subgraph';
        id: string;
        label: string;
      };
    }
  >;
  entities: Record<
    string,
    {
      mermaid: {
        kind: 'structural' | 'node';
        type: 'subgraph' | 'node';
        id: string;
        label: string;
        shape?: string;
      };
    }
  >;
  connections?: Record<
    string,
    {
      from: string;
      to: string;
      scope?: { root?: string; container?: string };
      mermaid?: { template?: string };
    }
  >;

  others?: {
    attributes?: {
      mermaid?: {
        kind?: 'node';
        type?: 'comment';
        id?: string;
        template?: string;
      };
    };
  };
};

export type MermaidStylesConfig = {
  version: number | string;
  kind: string;
  frontmatter?: {
    title?: string;
    config?: {
      theme?: string;
      look?: string;
      themeVariables?: Record<string, string | number | boolean>;
    };
  };
  themes?: Record<
    string,
    {
      roots?: Record<string, { style?: Record<string, string> }>;
      entities?: Record<
        string,
        {
          style?: Record<string, string>;
          // Attribute-node style overrides for attributes rendered under this entity.
          // Example: themes.light.entities.region.attributes
          attributes?: Record<string, string>;
        }
      >;
      statuses?: Record<string, { style?: Record<string, string> }>;
      visibility?: Record<string, { selector?: Record<string, unknown>; style?: Record<string, unknown> }>;
    }
  >;
};

export type LoadedNetboxConfig = {
  model: NetboxModelConfig;
  mapping: NetboxToMermaidConfig;
  styles: MermaidStylesConfig;
};
