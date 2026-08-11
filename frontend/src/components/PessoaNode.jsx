import React from 'react';
import { Handle, Position } from 'reactflow';
import './PessoaNode.css';

export default function PessoaNode({ data }) {
  return (
    <div className={`pessoa-node ${data.isMatch === false ? 'dimmed' : ''}`}>
      {/* ID 'top' adicionado para receber a linha dos pais */}
      <Handle type="target" position={Position.Top} id="top" className="handle" />
      
      {/* Ambas as laterais como 'source' com IDs específicos */}
      <Handle type="source" position={Position.Right} id="right" className="handle handle-centro" />
      <Handle type="source" position={Position.Left} id="left" className="handle handle-centro" />

      <div className="pessoa-avatar">
        {data.label ? data.label.charAt(0) : '?'}
      </div>
      
      <div className="pessoa-info">
        <div className="pessoa-nome">{data.label}</div>
        {data.apelido && <div className="pessoa-apelido">"{data.apelido}"</div>}
      </div>

      {/* ID 'bottom' adicionado para enviar a linha aos filhos */}
      <Handle type="source" position={Position.Bottom} id="bottom" className="handle" />
    </div>
  );
}