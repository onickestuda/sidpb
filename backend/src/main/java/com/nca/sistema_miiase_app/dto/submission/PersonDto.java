package com.nca.sistema_miiase_app.dto.submission;

// Nunca serializar a entidade Usuario com suas credenciais nos endpoints de curadoria.
public record PersonDto(Integer id, String name) { }
